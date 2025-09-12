package com.ssafy.samulnori.controller;

import java.io.IOException;
import java.util.List;

import com.ssafy.samulnori.model.dto.user.MyInfoRequestDTO;
import com.ssafy.samulnori.model.dto.user.MyInfoResponseDTO;
import com.ssafy.samulnori.model.dto.user.PageDTO;
import com.ssafy.samulnori.model.dto.user.UserDTO;
import com.ssafy.samulnori.oauth2.LoginUserPrincipal;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import com.ssafy.samulnori.model.service.UserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    // 내 정보 조회
    @GetMapping("/me")
    public ResponseEntity<MyInfoResponseDTO> getMyInfo(@AuthenticationPrincipal LoginUserPrincipal user) {
        Long myId = Long.valueOf(user.getUserId());
        MyInfoResponseDTO dto = userService.getMyInfo(myId);
        return ResponseEntity.ok(dto);
    }

    // 내 정보 수정
    @PutMapping(value = "/me", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> updateMyInfo(
            @AuthenticationPrincipal LoginUserPrincipal user,
            @ModelAttribute MyInfoRequestDTO request) throws IOException {

        Long myId = Long.valueOf(user.getUserId());
        userService.updateMyInfo(myId, request);
        return ResponseEntity.ok("정보 수정 완료");
    }

    // 회원탈퇴
    @DeleteMapping("/me")
    public ResponseEntity<?> deleteUser(@AuthenticationPrincipal LoginUserPrincipal user, HttpServletResponse response) {

        Long myId = Long.valueOf(user.getUserId());
        userService.deleteUser(myId);

        // 탈퇴 후 쿠키 삭제
        String AccessToken = "AccessToken=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0";
        response.addHeader("Set-Cookie", AccessToken);

        String RefreshToken = "RefreshToken=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0";
        response.addHeader("Set-Cookie", RefreshToken);

        return ResponseEntity.ok("회원 탈퇴 완료");
    }

    // 사용자 검색
    @GetMapping("/search")
    public ResponseEntity<List<UserDTO>> searchUsers(@RequestParam String keyword) {
        return ResponseEntity.ok(userService.searchUsers(keyword));
    }

    // 유저 프로필 조회
    @GetMapping("/{userId}/profile")
    public ResponseEntity<PageDTO> getUserProfile(@PathVariable Long userId) {
        return ResponseEntity.ok(userService.getUserProfile(userId));
    }
}