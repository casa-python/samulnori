//package com.ssafy.samulnori.model.service;
//
//import com.ssafy.samulnori.model.dto.CommentRequestDto;
//import com.ssafy.samulnori.model.dto.CommentResponseDto;
//import com.ssafy.samulnori.model.entity.Comment;
//import com.ssafy.samulnori.model.entity.UserEntity;
//import com.ssafy.samulnori.model.entity.Video;
//import com.ssafy.samulnori.model.repository.CommentRepository;
//import com.ssafy.samulnori.model.repository.UserRepository;
//import com.ssafy.samulnori.model.repository.VideoRepository;
//import org.junit.jupiter.api.BeforeEach;
//import org.junit.jupiter.api.Test;
//import org.junit.jupiter.api.extension.ExtendWith;
//import org.mockito.*;
//import org.mockito.junit.jupiter.MockitoExtension;
//
//import java.time.LocalDateTime;
//import java.util.*;
//
//import static org.assertj.core.api.Assertions.*;
//import static org.mockito.Mockito.*;
//
//@ExtendWith(MockitoExtension.class)
//class CommentServiceTest {
//
//    @InjectMocks
//    private CommentService commentService;
//
//    @Mock
//    private CommentRepository commentRepository;
//    @Mock
//    private UserRepository userRepository;
//    @Mock
//    private VideoRepository videoRepository;
//
//    private UserEntity mockUser;
//    private Video mockVideo;
//    private Comment parentComment;
//
//    @BeforeEach
//    void setUp() {
//        mockUser = UserEntity.builder().id(1L).loginName("testuser").build();
//        mockVideo = Video.builder()
//                .id(1L)
//                .user(mockUser)
//                .title("video")
//                .createdAt(LocalDateTime.now())
//                .commentCnt(0)
//                .build();
//        parentComment = Comment.builder()
//                .id(10L)
//                .user(mockUser)
//                .video(mockVideo)
//                .content("parent")
//                .createdAt(LocalDateTime.now())
//                .build();
//    }
//
//    @Test
//    void createComment_parent_success() {
//        // given
//        CommentRequestDto dto = new CommentRequestDto();
//        dto.setContent("hello");
//
//        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));
//        when(videoRepository.findById(1L)).thenReturn(Optional.of(mockVideo));
//        when(commentRepository.save(any(Comment.class)))
//                .thenAnswer(invocation -> {
//                    Comment saved = invocation.getArgument(0);
//                    saved.setId(100L);
//                    saved.setCreatedAt(LocalDateTime.now()); // ★ 이 줄 반드시 필요
//                    return saved;
//                });
//
//        // when
//        CommentResponseDto result = commentService.createComment(1L, 1L, dto);
//
//        // then
//        assertThat(result.getContent()).isEqualTo("hello");
//        verify(commentRepository).save(any());
//    }
//
//    @Test
//    void createComment_reply_success() {
//        // given
//        CommentRequestDto dto = new CommentRequestDto();
//        dto.setContent("reply");
//        dto.setParentCommentId(10L);
//
//        when(userRepository.findById(1L)).thenReturn(Optional.of(mockUser));
//        when(videoRepository.findById(1L)).thenReturn(Optional.of(mockVideo));
//        when(commentRepository.findById(10L)).thenReturn(Optional.of(parentComment));
//        when(commentRepository.save(any(Comment.class)))
//                .thenAnswer(invocation -> {
//                    Comment saved = invocation.getArgument(0);
//                    saved.setId(200L); // ID만 다르게 해도 됨
//                    saved.setCreatedAt(LocalDateTime.now()); // ★ 이 줄 반드시 필요
//                    return saved;
//                });
//
//        // when
//        CommentResponseDto result = commentService.createComment(1L, 1L, dto);
//
//        // then
//        assertThat(result.getContent()).isEqualTo("reply");
//        verify(commentRepository).save(any());
//    }
//
//    @Test
//    void updateComment_success() {
//        Comment comment = Comment.builder()
//                .id(1L)
//                .user(mockUser)
//                .content("old content")
//                .video(mockVideo)
//                .createdAt(LocalDateTime.now())
//                .build();
//
//        when(commentRepository.findById(1L)).thenReturn(Optional.of(comment));
//
//        CommentResponseDto result = commentService.updateComment(1L, 1L, "new content");
//
//        assertThat(result.getContent()).isEqualTo("new content");
//    }
//
//    @Test
//    void deleteComment_success() {
//        Comment comment = Comment.builder()
//                .id(1L)
//                .user(mockUser)
//                .content("to delete")
//                .video(mockVideo)
//                .createdAt(LocalDateTime.now())
//                .build();
//
//        when(commentRepository.findById(1L)).thenReturn(Optional.of(comment));
//
//        commentService.deleteComment(1L, 1L);
//
//        verify(commentRepository).delete(comment);
//    }
//
//    @Test
//    void deleteComment_fail_unauthorized() {
//        UserEntity otherUser = UserEntity.builder().id(2L).build();
//        Comment comment = Comment.builder()
//                .id(1L)
//                .user(otherUser)
//                .video(mockVideo)
//                .createdAt(LocalDateTime.now())
//                .build();
//
//        when(commentRepository.findById(1L)).thenReturn(Optional.of(comment));
//
//        assertThatThrownBy(() -> commentService.deleteComment(1L, 1L))
//                .isInstanceOf(SecurityException.class)
//                .hasMessage("본인의 댓글만 수정/삭제할 수 있습니다.");
//    }
//}
