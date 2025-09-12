package com.ssafy.samulnori.model.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "user_follow", uniqueConstraints = @UniqueConstraint(columnNames = {"follower_id", "followee_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Follow {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "follower_id", nullable = false)
    private UserEntity follower;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "followee_id", nullable = false)
    private UserEntity followee;

    @Builder
    public Follow(UserEntity follower, UserEntity followee) {
        this.follower = follower;
        this.followee = followee;
    }

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}

