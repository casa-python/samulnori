package com.ssafy.samulnori.controller;

import com.ssafy.samulnori.oauth2.LoginUserPrincipal;
import com.ssafy.samulnori.model.dto.VideoRequestDto;
import com.ssafy.samulnori.model.dto.VideoResponseDto;
import com.ssafy.samulnori.model.service.VideoService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.net.URI;
import java.util.List;

@RestController
@RequestMapping(value = "/videos", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class VideoController {

    private final VideoService videoService;

    // 전체 영상 목록 조회 (정렬: latest / popular) (비인증 허용)
    @GetMapping
    public ResponseEntity<List<VideoResponseDto>> getAllVideos(
            @RequestParam(defaultValue = "latest") String sortBy) {
        if ("popular".equalsIgnoreCase(sortBy)) {
            return ResponseEntity.ok(videoService.getPopularVideos());
        } else {
            // latest: updatedAt 기준으로 서비스에서 정렬
            return ResponseEntity.ok(videoService.getLatestVideos());
        }
    }

    // 단일 영상 조회 (조회수 증가 포함) (비인증 허용)
    @GetMapping("/{id}")
    public ResponseEntity<VideoResponseDto> getVideo(
            @PathVariable Long id,
            @AuthenticationPrincipal LoginUserPrincipal userDetails) {
        Long userId = (userDetails != null) ? Long.parseLong(userDetails.getUserId()) : null;
        return ResponseEntity.ok(videoService.getVideo(id, userId));
    }

    // 영상 키워드 검색 (비인증 허용)
    @GetMapping("/search")
    public ResponseEntity<List<VideoResponseDto>> searchVideos(@RequestParam String keyword) {
        return ResponseEntity.ok(videoService.searchVideos(keyword == null ? "" : keyword.trim()));
    }

    // 본인이 업로드한 영상 목록 조회 (인증 필요)
    @GetMapping("/my")
    public ResponseEntity<?> getMyVideos(@AuthenticationPrincipal LoginUserPrincipal userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("{\"error\":\"Unauthorized\"}");
        }
        Long userId = Long.parseLong(userDetails.getUserId());
        return ResponseEntity.ok(videoService.getVideosByUser(userId));
    }

    // 본인이 팔로우 한 사람들의 영상 목록 조회 (인증 필요)
    @GetMapping("/following")
    public ResponseEntity<?> getFollowingVideos(@AuthenticationPrincipal LoginUserPrincipal userDetails) {
        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("{\"error\":\"Unauthorized\"}");
        }
        Long userId = Long.parseLong(userDetails.getUserId());
        return ResponseEntity.ok(videoService.getFollowingVideos(userId));
    }

    // ===================== 업로드 / 수정 =====================

    // 영상 업로드 (인증 필요) - 멀티파트
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadVideo(
            @AuthenticationPrincipal LoginUserPrincipal userDetails,
            @ModelAttribute VideoRequestDto requestDto) throws IOException {

        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("{\"error\":\"Unauthorized\"}");
        }

        // 업로드 필수값 1차 검증(컨트롤러 레벨에서 바로 400으로 돌려보냄)
        if (requestDto.getVideoFile() == null || requestDto.getVideoFile().isEmpty()) {
            return ResponseEntity.badRequest().body("{\"error\":\"videoFile is required\"}");
        }
        if (requestDto.getTitle() == null || requestDto.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body("{\"error\":\"title is required\"}");
        }

        // 사용자 주입
        requestDto.setUserId(Long.parseLong(userDetails.getUserId()));

        VideoResponseDto responseDto = videoService.uploadVideo(requestDto);

        // 201 Created + Location 헤더 (REST 관례)
        HttpHeaders headers = new HttpHeaders();
        headers.setLocation(URI.create("/videos/" + responseDto.getId()));
        return new ResponseEntity<>(responseDto, headers, HttpStatus.CREATED);
    }

    // 영상 수정 (인증 필요) - 멀티파트
    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateVideo(
            @PathVariable Long id,
            @AuthenticationPrincipal LoginUserPrincipal userDetails,
            @ModelAttribute VideoRequestDto requestDto) throws IOException {

        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("{\"error\":\"Unauthorized\"}");
        }

        // 수정 시에는 제목이 비어 있으면 400
        if (requestDto.getTitle() == null || requestDto.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body("{\"error\":\"title is required\"}");
        }
        // videoFile/thumbnailFile은 선택(없으면 기존 유지) → 서비스에서 처리

        Long userId = Long.parseLong(userDetails.getUserId());
        VideoResponseDto dto = videoService.updateVideo(id, requestDto, userId);
        return ResponseEntity.ok(dto);
    }

    // 영상 삭제 (인증 필요)
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteVideo(
            @PathVariable Long id,
            @AuthenticationPrincipal LoginUserPrincipal userDetails) {

        if (userDetails == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("{\"error\":\"Unauthorized\"}");
        }
        Long userId = Long.parseLong(userDetails.getUserId());
        videoService.deleteVideo(id, userId);
        return ResponseEntity.noContent().build();
    }
}
