package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"strings"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/sirupsen/logrus"
)

var logger = logrus.New()

func main() {
	var socketPath string
	flag.StringVar(&socketPath, "socket", "/run/guest-services/backend.sock", "Unix domain socket to listen on")
	flag.Parse()

	_ = os.RemoveAll(socketPath)

	logger.SetOutput(os.Stdout)

	logMiddleware := middleware.LoggerWithConfig(middleware.LoggerConfig{
		Skipper: middleware.DefaultSkipper,
		Format: `{"time":"${time_rfc3339_nano}","id":"${id}",` +
			`"method":"${method}","uri":"${uri}",` +
			`"status":${status},"error":"${error}"` +
			`}` + "\n",
		CustomTimeFormat: "2006-01-02 15:04:05.00000",
		Output:           logger.Writer(),
	})

	logger.Infof("Starting listening on %s\n", socketPath)
	router := echo.New()
	router.HideBanner = true
	router.Use(logMiddleware)
	startURL := ""

	ln, err := listen(socketPath)
	if err != nil {
		logger.Fatal(err)
	}
	router.Listener = ln

	router.GET("/containers", listContainers)
	router.POST("/containers", createContainer)

	logger.Fatal(router.Start(startURL))
}

func listen(path string) (net.Listener, error) {
	return net.Listen("unix", path)
}

func listContainers(ctx echo.Context) error {
	c, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}

	containerCtx := context.Background()

	containers, err := c.ContainerList(containerCtx, types.ContainerListOptions{
		Filters: filters.NewArgs(filters.Arg("label", "mongodb-atlas-local=container")),
	})
	if err != nil {
		return err
	}

	response := []ListContainersResponse{}

	for _, container := range containers {
		inspect, err := c.ContainerInspect(containerCtx, container.ID)
		if err != nil {
			return err
		}

		env := inspect.Config.Env
		username := ""
		password := ""
		dbName := "test"
		for _, e := range env {
			if strings.HasPrefix(e, "MONGODB_INITDB_ROOT_USERNAME=") {
				username = strings.TrimPrefix(e, "MONGODB_INITDB_ROOT_USERNAME=")
			}
			if strings.HasPrefix(e, "MONGODB_INITDB_ROOT_PASSWORD=") {
				password = strings.TrimPrefix(e, "MONGODB_INITDB_ROOT_PASSWORD=")
			}
			if strings.HasPrefix(e, "MONGODB_INITDB_DATABASE=") {
				dbName = strings.TrimPrefix(e, "MONGODB_INITDB_DATABASE=")
			}
		}

		ports := inspect.NetworkSettings.Ports["27017/tcp"]
		port := "0"
		if len(ports) > 0 {
			port = ports[0].HostPort
		}

		connectionString := ""
		if port != "0" {
			if username != "" && password != "" {
				connectionString = fmt.Sprintf("mongodb://%s:%s@localhost:%s/%s?directConnection=true&authSource=admin", username, password, port, dbName)
			} else {
				connectionString = fmt.Sprintf("mongodb://localhost:%s/%s?directConnection=true", port, dbName)
			}
		}

		name := container.ID[:12]
		if len(container.Names) > 0 && container.Names[0] != "" {
			if container.Names[0][0] == '/' {
				name = container.Names[0][1:]
			} else {
				name = container.Names[0]
			}
		}

		response = append(response, ListContainersResponse{
			Id:               container.ID,
			Name:             name,
			Status:           container.Status,
			Version:          container.Labels["version"],
			ConnectionString: connectionString,
		})
	}

	return ctx.JSON(http.StatusOK, response)
}

func createContainer(ctx echo.Context) error {
	body := new(CreateContainerBody)
	if err := ctx.Bind(body); err != nil {
		return err
	}

	c, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return err
	}

	port := "0"
	if body.Port != "" {
		port = body.Port
	}

	env := []string{}
	if body.Username != "" {
		env = append(env, fmt.Sprintf("MONGODB_INITDB_ROOT_USERNAME=%s", body.Username))
	}
	if body.Password != "" {
		env = append(env, fmt.Sprintf("MONGODB_INITDB_ROOT_PASSWORD=%s", body.Password))
	}

	containerCtx := context.Background()

	result, err := c.ContainerCreate(containerCtx, &container.Config{
		Hostname: body.Name,
		Image:    "mongodb/mongodb-atlas-local",
		Env:      env,
	}, &container.HostConfig{
		PortBindings: nat.PortMap{
			"27017/tcp": []nat.PortBinding{
				{
					HostIP:   "0.0.0.0",
					HostPort: port,
				},
			},
		},
	}, nil, nil, body.Name)
	if err != nil {
		return err
	}

	err = c.ContainerStart(containerCtx, result.ID, types.ContainerStartOptions{})
	if err != nil {
		return err
	}

	return ctx.JSON(http.StatusOK, map[string]string{"message": "Container created"})
}

type CreateContainerBody struct {
	Name     string `json:"name,omitempty"`
	Port     string `json:"port,omitempty"`
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
}

type ListContainersResponse struct {
	Id               string `json:"id,omitempty"`
	Name             string `json:"name,omitempty"`
	Port             string `json:"port,omitempty"`
	Status           string `json:"status,omitempty"`
	Version          string `json:"version,omitempty"`
	ConnectionString string `json:"connectionString,omitempty"`
}
