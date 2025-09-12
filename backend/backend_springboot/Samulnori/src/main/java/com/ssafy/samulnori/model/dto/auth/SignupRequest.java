package com.ssafy.samulnori.model.dto.auth;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.web.multipart.MultipartFile;

@Setter
@Getter
@Data
public class SignupRequest {
    private String email;
    private String password;
    private String nickname;
    private MultipartFile profileImg; // form-data에서 들어온 파일만 받기 위함 (DB에 저장 X)
}
