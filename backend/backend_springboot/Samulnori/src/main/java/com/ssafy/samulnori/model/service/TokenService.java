package com.ssafy.samulnori.model.service;

import com.ssafy.samulnori.model.entity.TokenEntity;
import com.ssafy.samulnori.model.entity.UserEntity;
import com.ssafy.samulnori.model.repository.TokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TokenService {

    private final TokenRepository tokenRepository;

    // 리프레시 토큰 저장 or 갱신
    public void saveRefreshToken(UserEntity user, String refreshToken, long expirySeconds) {
        LocalDateTime expiredAt = LocalDateTime.now().plus(expirySeconds, ChronoUnit.SECONDS);

        tokenRepository.findByUser(user)
                .ifPresentOrElse(
                        token -> {
                            token.setRefreshToken(refreshToken);
                            token.setRefreshExpiredAt(expiredAt);
                            token.setCreatedAt(LocalDateTime.now());
                            tokenRepository.save(token);
                        },
                        () -> tokenRepository.save(TokenEntity.builder()
                                .user(user)
                                .refreshToken(refreshToken)
                                .refreshExpiredAt(expiredAt)
                                .createdAt(LocalDateTime.now())
                                .build())
                );
    }

    public Optional<TokenEntity> findByRefreshToken(String token) {
        return tokenRepository.findByRefreshToken(token);
    }

    public void deleteByUser(UserEntity user) {
        tokenRepository.deleteByUser(user);
    }
}
