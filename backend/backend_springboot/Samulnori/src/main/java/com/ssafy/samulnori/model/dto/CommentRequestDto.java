package com.ssafy.samulnori.model.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CommentRequestDto {
    private String content;         // 댓글 내용
    private Long parentCommentId;   // 대댓글일 경우만 사용
}
