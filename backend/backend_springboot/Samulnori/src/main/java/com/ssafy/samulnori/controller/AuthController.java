package com.ssafy.samulnori.controller;

import com.ssafy.samulnori.model.dto.auth.LoginRequest;
import com.ssafy.samulnori.model.dto.auth.SignupRequest;
import com.ssafy.samulnori.model.entity.TokenEntity;
import com.ssafy.samulnori.model.entity.UserEntity;
import com.ssafy.samulnori.model.service.TokenService;
import com.ssafy.samulnori.model.service.UserService;
import com.ssafy.samulnori.util.JwtUtil;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.util.Optional;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final JwtUtil jwtUtil;
    private final TokenService tokenService;
    private final UserService userService;

    // ✅ 회원가입
    @PostMapping(value = "/signup", consumes = { "multipart/form-data" })
    public ResponseEntity<?> signup(@ModelAttribute SignupRequest request) {
        try {
            userService.signup(request);
            return ResponseEntity.ok("회원가입 성공");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("이미지 업로드 실패");
        }
    }

    // ✅ 로그인
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request, HttpServletResponse response) {
        try {
            UserEntity user = userService.login(request);

            String accessToken = jwtUtil.createAccessToken(
                    Long.toString(user.getId()), user.getLoginName(), "ROLE_USER");
            String refreshToken = jwtUtil.createRefreshToken(Long.toString(user.getId()), user.getLoginName());

            tokenService.saveRefreshToken(user, refreshToken, JwtUtil.REFRESH_EXP / 1000);

            addAccessTokenCookie(response, accessToken); // 👉 토큰 쿠키로 내려주기
            addRefreshTokenCookie(response, refreshToken);

            return ResponseEntity.ok("로그인 성공");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        }
    }

    // ✅ 액세스 토큰 재발급 (쿠키 기반)
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshAccessToken(
            @CookieValue(value = "RefreshToken", required = false) String refreshToken,
            HttpServletResponse response) {
        // 👉 쿠키에 refresh token이 없는 경우
        if (refreshToken == null || refreshToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Refresh token이 없습니다.");
        }

        // 👉 토큰 만료 여부 검사
        if (jwtUtil.isExpired(refreshToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("Refresh token이 만료되었습니다.");
        }

        // 👉 토큰에서 사용자 정보 추출
        String userId = jwtUtil.getId(refreshToken);
        String loginName = jwtUtil.getLoginName(refreshToken);

        // 👉 DB에 저장된 refresh token과 비교
        Optional<TokenEntity> tokenEntity = tokenService.findByRefreshToken(refreshToken);
        if (tokenEntity.isEmpty() || !tokenEntity.get().getUser().getLoginName().equals(loginName)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("유효하지 않은 Refresh token입니다.");
        }

        // 👉 새 access token 생성
        String newAccessToken = jwtUtil.createAccessToken(userId, loginName, "ROLE_USER");

        // 👉 쿠키에 새 access token 설정
        addAccessTokenCookie(response, newAccessToken);

        return ResponseEntity.ok("Access token 재발급 완료");
    }

    // ✅ 로그아웃 (refresh token을 쿠키에서 가져와 삭제)
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@CookieValue(value = "RefreshToken", required = false) String refreshToken,
            HttpServletResponse response) {

        // 👉 refresh token이 쿠키에 있을 경우 DB에서 제거
        if (refreshToken != null && !refreshToken.trim().isEmpty()) {
            try {
                userService.logout(refreshToken);
            } catch (IllegalArgumentException e) {
                // 토큰 유효성 오류 → 무시하고 쿠키만 제거
            }
        }

        // 👉 모든 토큰 쿠키 제거
        deleteAccessTokenCookie(response);
        deleteRefreshTokenCookie(response);

        return ResponseEntity.ok("로그아웃 완료");
    }

    // ✅ Set-Cookie 헤더로 accessToken 내려주기
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

    // ✅ 쿠키 삭제용 Set-Cookie
    private void deleteAccessTokenCookie(HttpServletResponse response) {
        String cookie = "AccessToken=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0";
        response.addHeader("Set-Cookie", cookie);
    }

    private void deleteRefreshTokenCookie(HttpServletResponse response) {
        String cookie = "RefreshToken=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0";
        response.addHeader("Set-Cookie", cookie);
    }
}
