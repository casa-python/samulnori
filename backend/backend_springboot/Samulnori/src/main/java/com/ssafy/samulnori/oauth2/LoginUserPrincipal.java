package com.ssafy.samulnori.oauth2;


import com.ssafy.samulnori.model.dto.auth.AuthUserDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.core.user.OAuth2User;

import java.util.Collection;
import java.util.Collections;
import java.util.Map;

@RequiredArgsConstructor
public class LoginUserPrincipal implements OAuth2User {

    private final AuthUserDTO authUserDTO;

    @Override
    public Map<String, Object> getAttributes() {
        return null;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        // ROLE_USER로 고정된 권한 설정
        return Collections.singletonList(new SimpleGrantedAuthority(authUserDTO.getRole()));
    }

    @Override
    public String getName() {
        // Spring Security에서 유저 식별 용도로 사용하는 값
        return authUserDTO.getLoginName();
    }

    public String getUserId() {
        return authUserDTO.getUserId();
    }
}

