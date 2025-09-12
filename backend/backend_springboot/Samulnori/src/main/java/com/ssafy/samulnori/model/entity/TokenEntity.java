package com.ssafy.samulnori.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "tokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TokenEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne // 한 유저당 한 개의 리프레시 토큰
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private UserEntity user;

    @Column(name = "refresh_token", nullable = false, columnDefinition = "TEXT")
    private String refreshToken;

    @Column(name = "refresh_expired_at", nullable = false)
    private LocalDateTime refreshExpiredAt;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}

