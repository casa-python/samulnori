package com.ssafy.samulnori.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true)
    private String email;

    private String password;

    @Column(nullable = false)
    private String nickname;

    @Column(name = "login_name")
    private String loginName;

    @Column(name = "profile_img")
    private String profileImg;

    @Column(name = "follower_cnt")
    private int followerCnt = 0;

    @Column(name = "video_cnt")
    private int videoCnt = 0;

    @Column(name = "introduce")
    private String introduce;

    @Column(name = "created_at")
    private LocalDateTime createdAt = LocalDateTime.now();
}
