package com.ssafy.samulnori.model.dto.auth;

import lombok.Data;

@Data
public class AuthUserDTO {
    private String userId;
    private String loginName;
    private String role;
}
