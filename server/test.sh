#!/bin/bash
docker volume create test-world
docker run -p 25565:25565 -p 25575:25575 -v test-world:/world servercraft