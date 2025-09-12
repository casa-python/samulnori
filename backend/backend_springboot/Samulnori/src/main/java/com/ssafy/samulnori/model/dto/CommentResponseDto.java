package com.ssafy.samulnori.model.dto;

import lombok.Builder;
import lombok.Getter;


import com.ssafy.samulnori.model.entity.Comment;
import java.time.format.DateTimeFormatter;

@Getter
@Builder
public class CommentResponseDto {
    private Long id;               // 댓글 ID
    private Long userId;           // 작성자 ID
    private String nickname;       // 작성자 닉네임
    private String profileImage;   // 작성자 프로필 이미지
    private String content;        // 댓글 내용
    private String createdAt;      // 작성 일시 (yyyy-MM-dd HH:mm)
    private Long parentCommentId;  // 부모 댓글 ID (대댓글일 경우)

    private boolean isLiked;
    private int likeCount;


    public static CommentResponseDto from(Comment comment) {
        return from(comment, false, comment.getLikeCnt()); // 기본값 적용
    }

    public static CommentResponseDto from(Comment comment, boolean isLiked, int likeCount) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        return CommentResponseDto.builder()
                .id(comment.getId())
                .userId(comment.getUser().getId())
                .nickname(comment.getUser().getNickname())
                .profileImage(comment.getUser().getProfileImg())
                .content(comment.getContent())
                .createdAt(comment.getCreatedAt().format(formatter))
                .parentCommentId(comment.getParentComment() != null ? comment.getParentComment().getId() : null)
                .isLiked(isLiked)
                .likeCount(likeCount)
                .build();
    }
}