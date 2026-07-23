#!/bin/bash
set -e

JDK17=/usr/lib/jvm/java-17-openjdk-amd64

if [ ! -d "$JDK17" ]; then
  echo "Installing OpenJDK 17..."
  apt-get update -qq
  apt-get install -y -qq openjdk-17-jdk-headless
fi

echo "Switching to OpenJDK 17..."
update-alternatives --set java "$JDK17/bin/java" || true
update-alternatives --set javac "$JDK17/bin/javac" || true

# Configure Gradle to use JDK 17
mkdir -p android
echo "" >> android/gradle.properties
echo "# EAS Java 17 override" >> android/gradle.properties
echo "org.gradle.java.home=$JDK17" >> android/gradle.properties

echo "JAVA_HOME set to $JDK17"
