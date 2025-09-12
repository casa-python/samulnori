package com.ssafy.samulnori.model.repository;

import com.ssafy.samulnori.model.entity.Comment;
import com.ssafy.samulnori.model.entity.Video;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
public interface CommentRepository extends JpaRepository<Comment, Long> {

    // 특정 영상에 달린 부모 댓글만 조회
    List<Comment> findByVideoAndParentCommentIsNullOrderByCreatedAtDesc(Video video);

    // 특정 댓글의 대댓글 목록 조회
    List<Comment> findByParentCommentOrderByCreatedAtAsc(Comment parentComment);

}
