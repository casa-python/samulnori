package com.ssafy.samulnori.controller;

import com.ssafy.samulnori.model.entity.CommentLike;
import com.ssafy.samulnori.oauth2.LoginUserPrincipal;
import com.ssafy.samulnori.model.dto.CommentLikeResponseDto;
import com.ssafy.samulnori.model.dto.VideoLikeResponseDto;
import com.ssafy.samulnori.model.entity.Video;
import com.ssafy.samulnori.model.repository.VideoRepository;
import com.ssafy.samulnori.model.service.LikeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class LikeController {

    private final LikeService likeService;
    private final VideoRepository videoRepository;

    /**
     * 영상 좋아요 토글
     */
    @PostMapping("/videos/{videoId}/likes")
    public ResponseEntity<VideoLikeResponseDto> toggleVideoLike(
            Authentication authentication,
            @PathVariable Long videoId) {

        Long userId = getUserIdFromAuth(authentication);
        boolean isLiked = likeService.toggleVideoLike(userId, videoId);

        // 영상 좋아요 수 다시 가져오기
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 영상입니다."));
        int likeCount = video.getLikeCnt();

        return ResponseEntity.ok(
                VideoLikeResponseDto.builder()
                        .videoId(videoId)
                        .isLiked(isLiked)
                        .likeCount(likeCount)
                        .build()
        );
    }

    /**
     * 댓글 좋아요 토글
     */
    @PostMapping("/comments/{commentId}/likes")
    public ResponseEntity<Boolean> toggleCommentLike(
            Authentication authentication,
            @PathVariable Long commentId) {

        Long userId = getUserIdFromAuth(authentication);
        boolean isLiked = likeService.toggleCommentLike(userId, commentId);
        return ResponseEntity.ok(isLiked);
    }

    /**
     * 인증 객체에서 userId 추출
     */
    private Long getUserIdFromAuth(Authentication authentication) {
        LoginUserPrincipal userPrincipal = (LoginUserPrincipal) authentication.getPrincipal();
        return Long.parseLong(userPrincipal.getUserId());
    }

    @GetMapping("/like/{videoId}")
    private ResponseEntity<Boolean> checkVideoLike(@AuthenticationPrincipal LoginUserPrincipal user, @PathVariable Long videoId) {
        boolean isLiked = likeService.getLikeByUserAndVideo(Long.valueOf(user.getUserId()), videoId);
        return ResponseEntity.ok(isLiked);
    }

    @GetMapping("/comment/like/{videoId}")
    private ResponseEntity<List<Long>> checkCommentLike(@AuthenticationPrincipal LoginUserPrincipal user, @PathVariable Long videoId) {
        return ResponseEntity.ok(likeService.getCommentLikeByUserAndVideo(Long.valueOf(user.getUserId()), videoId));
    }
}