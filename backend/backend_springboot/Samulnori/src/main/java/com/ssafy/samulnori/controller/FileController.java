package com.ssafy.samulnori.controller;

import com.ssafy.samulnori.model.service.S3Uploader;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/files")
public class FileController {

    private final S3Uploader s3Uploader;

    // 프로필 이미지 업로드
    @PostMapping("/upload/profile")
    public ResponseEntity<String> uploadProfileImage(@RequestParam("file") MultipartFile file) {
        try {
            String url = s3Uploader.uploadProfileImage(file);
            return ResponseEntity.ok(url);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("프로필 이미지 업로드 실패: " + e.getMessage());
        }
    }

    // 영상 업로드
    @PostMapping("/upload/video")
    public ResponseEntity<String> uploadVideo(@RequestParam("file") MultipartFile file) {
        try {
            String url = s3Uploader.uploadVideo(file);
            return ResponseEntity.ok(url);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("영상 업로드 실패: " + e.getMessage());
        }
    }

    // 썸네일 이미지 업로드
    @PostMapping("/upload/thumbnail")
    public ResponseEntity<String> uploadThumbnail(@RequestParam("file") MultipartFile file) {
        try {
            String url = s3Uploader.uploadThumbnail(file);
            return ResponseEntity.ok(url);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("썸네일 업로드 실패: " + e.getMessage());
        }
    }
}