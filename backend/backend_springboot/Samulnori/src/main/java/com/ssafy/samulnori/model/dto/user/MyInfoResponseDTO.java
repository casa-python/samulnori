package com.ssafy.samulnori.model.dto.user;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class MyInfoResponseDTO {
    private Long id;
    private String email;
    private String nickname;
    private String profileImg; // S3 URL
    private String provider;
    private String introduce;
    private LocalDateTime createdAt;
}
