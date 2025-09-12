package com.ssafy.samulnori.controller;

import com.ssafy.samulnori.model.dto.CommentRequestDto;
import com.ssafy.samulnori.model.dto.CommentResponseDto;
import com.ssafy.samulnori.oauth2.LoginUserPrincipal;
import com.ssafy.samulnori.model.service.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/videos/{videoId}/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    /**
     * 댓글 등록 (댓글 or 대댓글)
     */
    @PostMapping
    public ResponseEntity<CommentResponseDto> createComment(
            @AuthenticationPrincipal LoginUserPrincipal userDetails,
            @PathVariable Long videoId,
            @RequestBody CommentRequestDto requestDto) {
        Long userId = Long.parseLong(userDetails.getUserId());
        return ResponseEntity.ok(commentService.createComment(userId, videoId, requestDto));
    }

    /**
     * 부모 댓글 목록 조회 (최신순)
     */
    @GetMapping
    public ResponseEntity<List<CommentResponseDto>> getParentComments(
            @PathVariable Long videoId,
            @AuthenticationPrincipal LoginUserPrincipal userDetails) {

        Long userId = (userDetails != null) ? Long.parseLong(userDetails.getUserId()) : null;
        return ResponseEntity.ok(commentService.getParentCommentsByVideo(videoId, userId));
    }

    /**
     * 대댓글 조회 (오래된 순)
     */
    @GetMapping("/{parentId}/replies")
    public ResponseEntity<List<CommentResponseDto>> getReplies(
            @PathVariable Long videoId,
            @PathVariable Long parentId,
            @AuthenticationPrincipal LoginUserPrincipal userDetails) {

        Long userId = (userDetails != null) ? Long.parseLong(userDetails.getUserId()) : null;
        return ResponseEntity.ok(commentService.getRepliesByParent(parentId, userId));
    }

    /**
     * 댓글 수정
     */
    @PutMapping("/{commentId}")
    public ResponseEntity<CommentResponseDto> updateComment(
            @AuthenticationPrincipal LoginUserPrincipal userDetails,
            @PathVariable Long videoId,
            @PathVariable Long commentId,
            @RequestBody CommentRequestDto requestDto) {
        Long userId = Long.parseLong(userDetails.getUserId());
        return ResponseEntity.ok(
                commentService.updateComment(commentId, userId, requestDto.getContent()));
    }

    /**
     * 댓글 삭제
     */
    @DeleteMapping("/{commentId}")
    public ResponseEntity<Void> deleteComment(
            @AuthenticationPrincipal LoginUserPrincipal userDetails,
            @PathVariable Long videoId,
            @PathVariable Long commentId) {
        Long userId = Long.parseLong(userDetails.getUserId());
        commentService.deleteComment(commentId, userId);
        return ResponseEntity.noContent().build();
    }
}
