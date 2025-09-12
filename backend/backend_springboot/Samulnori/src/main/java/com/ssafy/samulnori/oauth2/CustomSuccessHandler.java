package com.ssafy.samulnori.oauth2;

import com.ssafy.samulnori.model.entity.UserEntity;
import com.ssafy.samulnori.model.repository.UserRepository;
import com.ssafy.samulnori.model.service.TokenService;
import com.ssafy.samulnori.util.JwtUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

@Component
@RequiredArgsConstructor
public class CustomSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private final JwtUtil jwtUtil;
    private final TokenService tokenService;
    private final UserRepository userRepository;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response, Authentication authentication) throws IOException, ServletException {

        LoginUserPrincipal customUserDetails = (LoginUserPrincipal) authentication.getPrincipal();
        String loginName = customUserDetails.getName();
        String role = authentication.getAuthorities().iterator().next().getAuthority();
        String id = customUserDetails.getUserId();

        String accessToken = jwtUtil.createAccessToken(id, loginName, role);
        String refreshToken = jwtUtil.createRefreshToken(id, loginName);

        UserEntity user = userRepository.findByLoginName(loginName)
                .orElseThrow(() -> new RuntimeException("유저 정보 없음"));

        tokenService.saveRefreshToken(user, refreshToken, JwtUtil.REFRESH_EXP / 1000);

        // ✅ Set-Cookie 헤더로 accessToken 내려주기
        addAccessTokenCookie(response, accessToken);
        addRefreshTokenCookie(response, refreshToken);

        System.out.println("리다이렉트 + 토큰 전송");

        String redirectUrl = "http://localhost:3000/auth/redirect";

        getRedirectStrategy().sendRedirect(request, response, redirectUrl);
    }

    private void addAccessTokenCookie(HttpServletResponse response, String token) {
        String cookie = "AccessToken=" + token
                + "; Path=/"
                + "; HttpOnly"
                + "; Secure"
                + "; SameSite=None"
                + "; Max-Age=" + (JwtUtil.ACCESS_EXP / 1000);

        response.addHeader("Set-Cookie", cookie);
    }

    private void addRefreshTokenCookie(HttpServletResponse response, String token) {
        String cookie = "RefreshToken=" + token
                + "; Path=/"
                + "; HttpOnly"
                + "; Secure"
                + "; SameSite=None"
                + "; Max-Age=" + (JwtUtil.REFRESH_EXP / 1000);

        response.addHeader("Set-Cookie", cookie);
    }
}
