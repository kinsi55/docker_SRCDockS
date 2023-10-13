#!/bin/sh

docker build -t kinsi55/srcdocks:latest -t kinsi55/srcdocks:watchdog -f watchdog/Dockerfile .