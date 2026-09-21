#!/bin/sh
set -eu
exec sh "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/utools/build.sh" "$@"
