package com.ssafy.samulnori.util;

import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class JwtUtil {

    private SecretKey secretKey;

    public static final long ACCESS_EXP = 1000L * 60 * 15;           // 15분
    public static final long REFRESH_EXP = 1000L * 60 * 60 * 2;      // 2시간

    public JwtUtil(@Value("${spring.jwt.secret}") String secret) {
        this.secretKey = new SecretKeySpec(
                secret.getBytes(StandardCharsets.UTF_8),
                Jwts.SIG.HS256.key().build().getAlgorithm()
        );
    }

    // ✅ 공통 JWT 생성
    public String createJwt(String id, String loginName, String role, Long expiredMs) {
        return Jwts.builder()
                .claim("id", id)
                .claim("loginName", loginName)
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expiredMs))
                .signWith(secretKey)
                .compact();
    }

    // ✅ Access Token 생성
    public String createAccessToken(String id, String loginName, String role) {
        return createJwt(id, loginName, role, ACCESS_EXP);
    }

    // ✅ Refresh Token 생성
    public String createRefreshToken(String id,String loginName) {
        // 리프레시 토큰은 role이 필요 없으므로 null
        return Jwts.builder()
                .claim("id", id)    
                .claim("loginName", loginName)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + REFRESH_EXP))
                .signWith(secretKey)
                .compact();
    }

    // ✅ 만료 여부 확인
    public Boolean isExpired(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .getExpiration()
                .before(new Date());
    }

    // ✅ 유저 ID 추출
    public String getId(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get("id", String.class);
    }

    // ✅ 로그인 이름 추출
    public String getLoginName(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get("loginName", String.class);
    }

    // ✅ 역할 추출
    public String getRole(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload()
                .get("role", String.class);
    }
}
