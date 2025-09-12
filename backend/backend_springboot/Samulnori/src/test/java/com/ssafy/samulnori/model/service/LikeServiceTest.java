//package com.ssafy.samulnori.model.service;
//
//import com.ssafy.samulnori.model.entity.*;
//import com.ssafy.samulnori.model.repository.*;
//import org.junit.jupiter.api.BeforeEach;
//import org.junit.jupiter.api.Test;
//import org.junit.jupiter.api.extension.ExtendWith;
//import org.mockito.*;
//import org.mockito.junit.jupiter.MockitoExtension;
//
//import java.util.Optional;
//
//import static org.assertj.core.api.Assertions.assertThat;
//import static org.mockito.Mockito.*;
//
//@ExtendWith(MockitoExtension.class)
//class LikeServiceTest {
//
//    @InjectMocks
//    private LikeService likeService;
//
//    @Mock
//    private UserRepository userRepository;
//    @Mock
//    private VideoRepository videoRepository;
//    @Mock
//    private CommentRepository commentRepository;
//    @Mock
//    private VideoLikeRepository videoLikeRepository;
//    @Mock
//    private CommentLikeRepository commentLikeRepository;
//
//    private UserEntity mockUser;
//    private Video mockVideo;
//    private Comment mockComment;
//
//    @BeforeEach
//    void setUp() {
//        mockUser = UserEntity.builder().id(1L).loginName("user").build();
//        mockVideo = Video.builder().id(1L).user(mockUser).title("video").build();
//        mockComment = Comment.builder().id(1L).user(mockUser).content("comment").build();
//    }
//
//    @Test
//    void toggleVideoLike_firstTime_likeOn() {
//        // given
//        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));
//        when(videoRepository.findById(1L)).thenReturn(Optional.of(mockVideo));
//        when(videoLikeRepository.findByUserAndVideo(mockUser, mockVideo)).thenReturn(Optional.empty());
//        when(videoLikeRepository.countByVideoAndIsLikedTrue(mockVideo)).thenReturn(1L);
//
//        // when
//        boolean result = likeService.toggleVideoLike(1L, 1L);
//
//        // then
//        assertThat(result).isTrue(); // 첫 토글 후 좋아요 상태는 true
//        verify(videoLikeRepository).save(any(VideoLike.class));
//        verify(videoRepository).save(mockVideo);
//    }
//
//    @Test
//    void toggleVideoLike_alreadyLiked_toggleOff() {
//        // given
//        VideoLike existingLike = VideoLike.builder()
//                .user(mockUser).video(mockVideo).isLiked(true).build();
//
//        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));
//        when(videoRepository.findById(1L)).thenReturn(Optional.of(mockVideo));
//        when(videoLikeRepository.findByUserAndVideo(mockUser, mockVideo)).thenReturn(Optional.of(existingLike));
//        when(videoLikeRepository.countByVideoAndIsLikedTrue(mockVideo)).thenReturn(0L);
//
//        // when
//        boolean result = likeService.toggleVideoLike(1L, 1L);
//
//        // then
//        assertThat(result).isFalse(); // 토글 꺼짐
//        verify(videoLikeRepository).save(existingLike);
//        verify(videoRepository).save(mockVideo);
//    }
//
//    @Test
//    void toggleCommentLike_firstTime_likeOn() {
//        // given
//        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));
//        when(commentRepository.findById(1L)).thenReturn(Optional.of(mockComment));
//        when(commentLikeRepository.findByUserAndComment(mockUser, mockComment)).thenReturn(Optional.empty());
//        when(commentLikeRepository.countByCommentAndIsLikedTrue(mockComment)).thenReturn(1L);
//
//        // when
//        boolean result = likeService.toggleCommentLike(1L, 1L);
//
//        // then
//        assertThat(result).isTrue();
//        verify(commentLikeRepository).save(any(CommentLike.class));
//        verify(commentRepository).save(mockComment);
//    }
//
//    @Test
//    void toggleCommentLike_alreadyLiked_toggleOff() {
//        // given
//        CommentLike existingLike = CommentLike.builder()
//                .user(mockUser).comment(mockComment).isLiked(true).build();
//
//        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));
//        when(commentRepository.findById(1L)).thenReturn(Optional.of(mockComment));
//        when(commentLikeRepository.findByUserAndComment(mockUser, mockComment)).thenReturn(Optional.of(existingLike));
//        when(commentLikeRepository.countByCommentAndIsLikedTrue(mockComment)).thenReturn(0L);
//
//        // when
//        boolean result = likeService.toggleCommentLike(1L, 1L);
//
//        // then
//        assertThat(result).isFalse();
//        verify(commentLikeRepository).save(existingLike);
//        verify(commentRepository).save(mockComment);
//    }
//}
