#!/bin/bash
set -e

GRADLE_PROPS="android/gradle.properties"
JDK17=/usr/lib/jvm/java-17-openjdk-amd64

if [ -f "$GRADLE_PROPS" ]; then
  echo "Patching $GRADLE_PROPS to remove Java 8-only JVM args..."
  # Remove MaxPermSize which is invalid on Java 17+
  sed -i 's/-XX:MaxPermSize=[^ ]*//g' "$GRADLE_PROPS"

  # Ensure org.gradle.jvmargs uses Java 17-compatible options
  if grep -q '^org.gradle.jvmargs=' "$GRADLE_PROPS"; then
    sed -i 's/^org.gradle.jvmargs=.*/org.gradle.jvmargs=-XX:MaxMetaspaceSize=512m -Xmx4g -Dfile.encoding=UTF-8/' "$GRADLE_PROPS"
  else
    echo "org.gradle.jvmargs=-XX:MaxMetaspaceSize=512m -Xmx4g -Dfile.encoding=UTF-8" >> "$GRADLE_PROPS"
  fi

  # Point Gradle to the JDK 17 home
  if grep -q '^org.gradle.java.home=' "$GRADLE_PROPS"; then
    sed -i "s|^org.gradle.java.home=.*|org.gradle.java.home=$JDK17|" "$GRADLE_PROPS"
  else
    echo "org.gradle.java.home=$JDK17" >> "$GRADLE_PROPS"
  fi

  echo "$GRADLE_PROPS updated."
else
  echo "Warning: $GRADLE_PROPS not found. Skipping post-install patch."
fi

# EAS images sometimes inject -XX:MaxPermSize in the user's Gradle properties
USER_GRADLE_PROPS="$HOME/.gradle/gradle.properties"
if [ -f "$USER_GRADLE_PROPS" ]; then
  echo "Patching $USER_GRADLE_PROPS to remove MaxPermSize..."
  sed -i 's/-XX:MaxPermSize=[^ ]*//g' "$USER_GRADLE_PROPS"
  echo "$USER_GRADLE_PROPS updated."
fi
