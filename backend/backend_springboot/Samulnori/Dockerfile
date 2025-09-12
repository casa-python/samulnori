FROM openjdk:21
ARG JAR_FILE=target/*.jar

# 빌드된 jar 복사
COPY target/app.jar /app/app.jar

# 앱 실행
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
