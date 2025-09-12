package com.ssafy.samulnori.model.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "social_accounts", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"provider", "providerId"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SocialAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;

    @Column(name = "provider", nullable = false)
    private String provider; // ex: google, kakao, naver

    @Column(name = "provider_id", nullable = false)
    private String providerId;

    @Column(name = "access_token", columnDefinition = "TEXT")
    private String accessToken;

    @Column(name = "refresh_token", columnDefinition = "TEXT")
    private String refreshToken;
}
