package com.ssafy.samulnori.model.service;

import com.ssafy.samulnori.model.dto.CommentRequestDto;
import com.ssafy.samulnori.model.dto.CommentResponseDto;
import com.ssafy.samulnori.model.entity.Comment;
import com.ssafy.samulnori.model.entity.UserEntity;
import com.ssafy.samulnori.model.entity.Video;
import com.ssafy.samulnori.model.repository.CommentLikeRepository;
import com.ssafy.samulnori.model.repository.CommentRepository;
import com.ssafy.samulnori.model.repository.UserRepository;
import com.ssafy.samulnori.model.repository.VideoRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;
import com.ssafy.samulnori.model.entity.CommentLike;

@Service
@RequiredArgsConstructor
public class CommentService {

    private final CommentRepository commentRepository;
    private final UserRepository userRepository;
    private final VideoRepository videoRepository;
    private final CommentLikeRepository commentLikeRepository;

    /**
     * 댓글 등록 (댓글 or 대댓글)
     */
    @Transactional
    public CommentResponseDto createComment(Long userId, Long videoId, CommentRequestDto requestDto) {
        UserEntity user = getUserById(userId);
        Video video = getVideoById(videoId);
        Comment parent = requestDto.getParentCommentId() != null
                ? getCommentById(requestDto.getParentCommentId())
                : null;

        Comment comment = Comment.builder()
                .user(user)
                .video(video)
                .content(requestDto.getContent())
                .parentComment(parent)
                .build();

        // 부모 댓글일 경우에만 댓글 수 증가
        if (parent == null) {
            video.setCommentCnt(video.getCommentCnt() + 1);
        }

        return CommentResponseDto.from(commentRepository.save(comment));
    }

    /**
     * 부모 댓글 조회 (최신순)
     */
    public List<CommentResponseDto> getParentCommentsByVideo(Long videoId, Long userId) {
        Video video = getVideoById(videoId);
        return commentRepository.findByVideoAndParentCommentIsNullOrderByCreatedAtDesc(video).stream()
                .map(comment -> {
                    boolean isLiked = false;
                    if (userId != null) {
                        UserEntity user = getUserById(userId);
                        isLiked = commentLikeRepository
                                .findByUserAndComment(user, comment)
                                .map(CommentLike::isLiked)
                                .orElse(false);
                    }
                    int likeCount = (int) commentLikeRepository.countByCommentAndIsLikedTrue(comment);
                    return CommentResponseDto.from(comment, isLiked, likeCount);
                })
                .collect(Collectors.toList());
    }

    /**
     * 대댓글 조회 (오래된 순)
     */
    public List<CommentResponseDto> getRepliesByParent(Long parentId, Long userId) {
        Comment parent = getCommentById(parentId);
        return commentRepository.findByParentCommentOrderByCreatedAtAsc(parent).stream()
                .map(reply -> {
                    boolean isLiked = false;
                    if (userId != null) {
                        UserEntity user = getUserById(userId);
                        isLiked = commentLikeRepository
                                .findByUserAndComment(user, reply)
                                .map(CommentLike::isLiked)
                                .orElse(false);
                    }
                    int likeCount = (int) commentLikeRepository.countByCommentAndIsLikedTrue(reply);
                    return CommentResponseDto.from(reply, isLiked, likeCount);
                })
                .collect(Collectors.toList());
    }

    /**
     * 댓글 수정
     */
    @Transactional
    public CommentResponseDto updateComment(Long commentId, Long userId, String content) {
        Comment comment = getCommentById(commentId);
        validateOwner(comment, userId);
        comment.updateContent(content);
        return CommentResponseDto.from(comment);
    }

    /**
     * 댓글 삭제
     */
    @Transactional
    public void deleteComment(Long commentId, Long userId) {
        Comment comment = getCommentById(commentId);
        validateOwner(comment, userId);

        Video video = comment.getVideo(); // 삭제되는 댓글의 영상 참조

        commentRepository.delete(comment);

        // 부모 댓글일 경우에만 댓글 수 감소
        if (comment.getParentComment() == null) {
            video.setCommentCnt(video.getCommentCnt() - 1);
        }
    }

    // =================== Private Utilities ===================

    private UserEntity getUserById(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));
    }

    private Video getVideoById(Long videoId) {
        return videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 영상입니다."));
    }

    private Comment getCommentById(Long commentId) {
        return commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 댓글입니다."));
    }

    private void validateOwner(Comment comment, Long userId) {
        if (!comment.getUser().getId().equals(userId)) {
            throw new SecurityException("본인의 댓글만 수정/삭제할 수 있습니다.");
        }
    }
}
