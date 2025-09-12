package com.ssafy.samulnori.model.service;

import com.amazonaws.services.s3.AmazonS3;
import com.amazonaws.services.s3.model.CannedAccessControlList;
import com.amazonaws.services.s3.model.ObjectMetadata;
import com.amazonaws.services.s3.model.PutObjectRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class S3Uploader {

    private final AmazonS3 amazonS3;

    @Value("${S3_BUCKET_NAME}")
    private String bucket;

    /**
     * 공통 업로드 로직: key를 명시적으로 받아 업로드
     */
    private String put(String key, MultipartFile file, String cacheControl, boolean publicRead) throws IOException {
        ObjectMetadata metadata = new ObjectMetadata();
        metadata.setContentLength(file.getSize());
        // 파일에 contentType이 비어있으면 기본값 보정
        metadata.setContentType(file.getContentType() != null ? file.getContentType() : "application/octet-stream");
        if (cacheControl != null) {
            metadata.setCacheControl(cacheControl);
        }

        try (InputStream in = file.getInputStream()) {
            PutObjectRequest req = new PutObjectRequest(bucket, key, in, metadata);
            if (publicRead) {
                req = req.withCannedAcl(CannedAccessControlList.PublicRead);
            }
            amazonS3.putObject(req);
        }
        // 버킷 정책/CloudFront에 따라 아래 반환 URL은 바꿔도 됨
        return amazonS3.getUrl(bucket, key).toString();
    }

    /**
     * 디렉토리/랜덤 파일명으로 키 생성 (원본 확장자 유지)
     */
    private String randomKey(String dir, String originalFilename, String defaultExt) {
        String baseExt = defaultExt;
        if (originalFilename != null && originalFilename.contains(".")) {
            String ext = originalFilename.substring(originalFilename.lastIndexOf('.') + 1).toLowerCase();
            if (!ext.isBlank()) baseExt = ext;
        }
        return dir + "/" + UUID.randomUUID() + "." + baseExt;
    }

    // 공통 로직을 내부 메서드로 분리
    /**
     * (기존) 디렉토리만 받아 업로드 — 하위 호환용
     * - 캐시: 1년(immutable)
     * - ACL: bucket 정책에 맞게 publicRead=false로 두었음 (필요 시 true로 변경)
     */
    private String uploadFileToS3(MultipartFile file, String dirName) throws IOException {
        String key = randomKey(dirName, file.getOriginalFilename(), "bin");
        return put(key, file, "public, max-age=31536000, immutable", false);
    }

    // 프로필 이미지 업로드
    public String uploadProfileImage(MultipartFile file) throws IOException {
        return uploadFileToS3(file, "profile-images");
    }

    // 영상 업로드
    public String uploadVideo(MultipartFile file) throws IOException {
        return uploadFileToS3(file, "videos");
    }

    // 썸네일 업로드
    public String uploadThumbnail(MultipartFile file) throws IOException {
        return uploadFileToS3(file, "thumbnails");
    }

    // ===== 권장: videoId별 버저닝 키 사용 (새 키 생성) =====

    /** 권장: 영상 업로드(동일 videoId 디렉토리 아래 새 키) */
    public String uploadVideo(MultipartFile file, Long videoId) throws IOException {
        String ext = (file.getOriginalFilename() != null && file.getOriginalFilename().contains("."))
                ? file.getOriginalFilename().substring(file.getOriginalFilename().lastIndexOf('.') + 1).toLowerCase()
                : "mp4";
        String key = String.format("videos/%d/%s.%s", videoId, UUID.randomUUID(), ext);
        return put(key, file, "public, max-age=31536000, immutable", false);
    }

    /** 권장: 썸네일 업로드(동일 videoId 디렉토리 아래 새 키) */
    public String uploadThumbnail(MultipartFile file, Long videoId) throws IOException {
        // 썸네일은 png로 고정(프론트 캡처 기준) — 필요시 확장자 보존 로직으로 변경
        String key = String.format("thumbnails/%d/%s.png", videoId, UUID.randomUUID());
        return put(key, file, "public, max-age=31536000, immutable", false);
    }

    // (선택) 필요하면 키를 외부에서 완전 지정해서 올리는 메서드
    public String uploadWithKey(MultipartFile file, String key, boolean publicRead) throws IOException {
        return put(key, file, "public, max-age=31536000, immutable", publicRead);
    }
}