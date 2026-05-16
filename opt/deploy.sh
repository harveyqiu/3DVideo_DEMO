#!/usr/bin/env sh
set -eu

cd /opt/3DVideo_DEMO

git pull --ff-only
docker compose up --build -d
