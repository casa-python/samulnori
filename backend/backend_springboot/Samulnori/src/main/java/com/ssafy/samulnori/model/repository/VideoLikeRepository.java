package com.ssafy.samulnori.model.repository;

import com.ssafy.samulnori.model.entity.UserEntity;
import com.ssafy.samulnori.model.entity.Video;
import com.ssafy.samulnori.model.entity.VideoLike;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VideoLikeRepository extends JpaRepository<VideoLike, Long> {

    // 특정 사용자가 특정 영상에 대해 누른 좋아요 기록이 있는지 조회
    Optional<VideoLike> findByUserAndVideo(UserEntity user, Video video);

    // 해당 영상의 좋아요 수 조회 (isLiked = true 인 경우만)
    long countByVideoAndIsLikedTrue(Video video);

    // 좋아요 여부 확인용 메서드 추가
    boolean existsByUserIdAndVideoIdAndIsLikedTrue(Long userId, Long videoId);

}