#!/usr/bin/env sh

cd $(dirname $0)/..

mkdir -p artifacts/deploy/

curl -L https://github.com/saber-hq/stable-swap/releases/download/v1.6.7/stable_swap.so \
    >artifacts/deploy/stable_swap.so
