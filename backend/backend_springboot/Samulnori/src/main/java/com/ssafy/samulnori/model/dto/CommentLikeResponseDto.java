package com.ssafy.samulnori.model.dto;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class CommentLikeResponseDto {
    private Long commentId;
    private boolean isLiked; // 현재 좋아요 상태
    private int likeCount;   // 최신 좋아요 수
}