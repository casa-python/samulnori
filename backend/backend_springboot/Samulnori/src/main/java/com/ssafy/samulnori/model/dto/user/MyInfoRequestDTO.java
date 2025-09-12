package com.ssafy.samulnori.model.dto.user;

import java.time.LocalDateTime;

import lombok.Builder;
import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

@Data
@Builder
public class MyInfoRequestDTO  {
    private String email;
    private String nickname;
    private String currentPassword;
    private String newPassword;
    private MultipartFile profileImg;
    private String introduce;
    private String provider;
    private LocalDateTime createdAt;
}
