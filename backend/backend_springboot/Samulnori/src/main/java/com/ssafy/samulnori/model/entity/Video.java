package com.ssafy.samulnori.model.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
@Table(name = "videos")
public class Video {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;  // 영상 고유 ID

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private UserEntity user;  // 업로더 사용자

    @Column(nullable = false, length = 255)
    private String title;  // 영상 제목

    @Column(columnDefinition = "TEXT")
    private String description;  // 영상 설명

    @Column(name = "video_url", nullable = false, length = 512)
    private String videoUrl;  // 영상 파일 경로(URL)

    @Column(name = "thumbnail_url", length = 512)
    private String thumbnailUrl;  // 썸네일 이미지 경로

    @Column(name = "runtime", nullable = false)
    private Integer runtime;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;  // 업로드 시각

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;  // 마지막 수정 시각

    @Column(name = "view_cnt")
    private int viewCnt;  // 조회수

    @OneToMany(mappedBy = "video", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<VideoLike> likes = new ArrayList<>();

    @Column(name = "like_cnt")
    private int likeCnt;  // 좋아요 수

    @Column(name = "comment_cnt")
    private int commentCnt;  // 댓글 수

    /**
     * 댓글 리스트 매핑 (영상 삭제 시 연결된 댓글도 함께 삭제됨)
     */
    @OneToMany(mappedBy = "video", cascade = CascadeType.REMOVE, orphanRemoval = true)
    private List<Comment> comments = new ArrayList<>();

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @PrePersist
    protected void onCreate() {
        final LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // 영상 업데이트용 메서드
    public void update(String title, String description, String videoUrl, String thumbnailUrl, Integer runtime) {
        this.title = title;
        this.description = description;
        this.videoUrl = videoUrl;
        this.thumbnailUrl = thumbnailUrl;
        this.runtime = runtime;
    }

    // 조회수 증가 메서드
    public void increaseViewCount() {
        this.viewCnt += 1;
    }

    // 좋아요 수 업데이트용 메서드
    public void setLikeCnt(int likeCnt) {
        this.likeCnt = likeCnt;
    }

    public void setCommentCnt(int commentCnt) {
        this.commentCnt = commentCnt;
    }
}
