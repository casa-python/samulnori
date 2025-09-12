package com.ssafy.samulnori.model.dto;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class VideoLikeResponseDto {
    private Long videoId;
    private boolean isLiked; // 현재 좋아요 상태
    private int likeCount;   // 최신 좋아요 수
}