package com.ssafy.samulnori.model.dto;

import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

@Getter
@Setter
public class VideoRequestDto {
    private Long userId;                      // 업로더 사용자 ID
    private String title;                     // 영상 제목
    private String description;               // 영상 설명
    private MultipartFile videoFile;          // 실제 업로드할 영상 파일
    private Integer runtime;
    private MultipartFile thumbnailFile;      // 썸네일 이미지 파일
}
