package com.ssafy.samulnori.model.dto.user;

import java.util.List;

import com.ssafy.samulnori.model.dto.VideoResponseDto;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class PageDTO {
    private UserDTO userDTO;
    private List<VideoResponseDto> videos;
    private String introduce;
}
