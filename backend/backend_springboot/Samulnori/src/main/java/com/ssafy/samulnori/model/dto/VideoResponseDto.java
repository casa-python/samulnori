package com.ssafy.samulnori.model.dto;
import com.ssafy.samulnori.model.dto.user.UserDTO;
import com.ssafy.samulnori.model.entity.Video;
import lombok.Builder;
import lombok.Getter;

import java.time.format.DateTimeFormatter;

@Getter
@Builder
public class VideoResponseDto {
    private Long id;                   // 영상 ID
    private UserDTO uploader;          // 업로더 사용자 정보 (UserDTO)
    private String title;              // 영상 제목
    private String description;        // 영상 설명
    private String videoUrl;           // 영상 URL
    private String thumbnailUrl;       // 썸네일 URL
    private Integer runtime;
    private String createdAt;          // 업로드 시간 (yyyy-MM-dd HH:mm 형식)
    private String updatedAt;          // 마지막 수정 시간 (yyyy-MM-dd HH:mm)
    private int viewCnt;               // 조회수
    private int likeCnt;               // 좋아요 수
    private int commentCnt;            // 댓글 수

    private boolean likedByCurrentUser;

    public static VideoResponseDto from(Video video) {
        return from(video, false);
    }

    public static VideoResponseDto from(Video video, boolean likedByCurrentUser) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

        UserDTO uploader = new UserDTO();
        uploader.setId(video.getUser().getId());
        uploader.setNickname(video.getUser().getNickname());
        uploader.setProfileImg(video.getUser().getProfileImg());

        String createdAtStr = video.getCreatedAt() != null ? video.getCreatedAt().format(formatter) : null;
        String updatedAtStr = video.getUpdatedAt() != null
                ? video.getUpdatedAt().format(formatter)
                : createdAtStr; // updatedAt 없으면 createdAt로 대체

        return VideoResponseDto.builder()
                .id(video.getId())
                .uploader(uploader)
                .title(video.getTitle())
                .description(video.getDescription())
                .videoUrl(video.getVideoUrl())
                .thumbnailUrl(video.getThumbnailUrl())
                .runtime(video.getRuntime())
                .createdAt(createdAtStr)
                .updatedAt(updatedAtStr)
                .viewCnt(video.getViewCnt())
                .likeCnt(video.getLikeCnt())
                .commentCnt(video.getCommentCnt())
                .likedByCurrentUser(likedByCurrentUser)
                .build();
    }
}