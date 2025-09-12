package com.ssafy.samulnori.model.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LikeRequestDto {
    private Long userId; // 좋아요를 누른 사용자 ID
}