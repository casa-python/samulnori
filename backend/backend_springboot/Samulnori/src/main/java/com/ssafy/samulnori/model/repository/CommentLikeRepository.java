package com.ssafy.samulnori.model.repository;

import com.ssafy.samulnori.model.entity.UserEntity;
import com.ssafy.samulnori.model.entity.Comment;
import com.ssafy.samulnori.model.entity.CommentLike;
import com.ssafy.samulnori.model.entity.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface CommentLikeRepository extends JpaRepository<CommentLike, Long> {

    // 특정 사용자가 특정 댓글에 대해 누른 좋아요 기록이 있는지 조회
    Optional<CommentLike> findByUserAndComment(UserEntity user, Comment comment);

    // 해당 댓글의 좋아요 수 조회 (isLiked = true 인 경우만)
    long countByCommentAndIsLikedTrue(Comment comment);

    @Query("""
    select c.id
    from CommentLike cl
    join cl.comment c
    where cl.user.id = :userId
      and c.video.id = :videoId
      and c.parentComment is null
    order by c.createdAt desc
    """)
    List<Long> findLikedParentCommentIds(Long userId, Long videoId);

}