#!/bin/bash
set -e

JDK17=/usr/lib/jvm/java-17-openjdk-amd64

if [ ! -d "$JDK17" ]; then
  echo "OpenJDK 17 not found at $JDK17, installing..."
  sudo apt-get update -qq
  sudo apt-get install -y -qq openjdk-17-jdk-headless
  if [ ! -d "$JDK17" ]; then
    # Some images install under a slightly different path; symlink to the expected one
    INSTALLED=$(find /usr/lib/jvm -maxdepth 1 -type d -name '*java-17*' | head -n 1)
    if [ -z "$INSTALLED" ]; then
      echo "ERROR: OpenJDK 17 installation failed"
      exit 1
    fi
    sudo ln -s "$INSTALLED" "$JDK17"
  fi
fi

echo "Switching to OpenJDK 17..."
sudo update-alternatives --set java "$JDK17/bin/java" || true
sudo update-alternatives --set javac "$JDK17/bin/javac" || true

if [ -d "$JDK17" ]; then
  echo "JAVA_HOME will be $JDK17"
else
  echo "ERROR: $JDK17 does not exist after install"
  exit 1
fi
