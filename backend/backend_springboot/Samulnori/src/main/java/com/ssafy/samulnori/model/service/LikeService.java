package com.ssafy.samulnori.model.service;

import com.ssafy.samulnori.model.entity.*;
import com.ssafy.samulnori.model.repository.*;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LikeService {

    private final UserRepository userRepository;
    private final VideoRepository videoRepository;
    private final CommentRepository commentRepository;
    private final VideoLikeRepository videoLikeRepository;
    private final CommentLikeRepository commentLikeRepository;

    /**
     * 영상 좋아요 토글
     */
    @Transactional
    public boolean toggleVideoLike(Long userId, Long videoId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 영상입니다."));

        VideoLike like = videoLikeRepository.findByUserAndVideo(user, video)
                .orElse(VideoLike.builder().user(user).video(video).isLiked(false).build());

        like.toggle(); // isLiked true <-> false
        videoLikeRepository.saveAndFlush(like);

        // 좋아요 수 업데이트
        long likeCount = videoLikeRepository.countByVideoAndIsLikedTrue(video);
        video.setLikeCnt((int) likeCount); // setter가 필요함
        videoRepository.save(video);

        return like.isLiked(); // true면 좋아요 상태
    }

    public long getLikeCount(Long videoId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 영상입니다."));
        return videoLikeRepository.countByVideoAndIsLikedTrue(video);
    }

    /**
     * 댓글 좋아요 토글
     */
    @Transactional
    public boolean toggleCommentLike(Long userId, Long commentId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 댓글입니다."));

        CommentLike like = commentLikeRepository.findByUserAndComment(user, comment)
                .orElse(CommentLike.builder().user(user).comment(comment).isLiked(false).build());

        like.toggle(); // isLiked true <-> false
        commentLikeRepository.save(like);

        // 좋아요 수 업데이트
        long likeCount = commentLikeRepository.countByCommentAndIsLikedTrue(comment);
        comment.setLikeCnt((int) likeCount); // setter가 필요함
        commentRepository.save(comment);

        return like.isLiked();
    }

    public boolean getLikeByUserAndVideo(Long userId, Long videoId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 영상입니다."));

        return videoLikeRepository.findByUserAndVideo(user, video).isPresent();
    }

    @Transactional
    public List<Long> getCommentLikeByUserAndVideo(Long userId, Long videoId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 사용자입니다."));

        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 영상입니다."));

        return commentLikeRepository.findLikedParentCommentIds(user.getId(), video.getId());
    }
}