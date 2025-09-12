package com.ssafy.samulnori.controller;

import com.ssafy.samulnori.model.service.FollowService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import com.ssafy.samulnori.oauth2.LoginUserPrincipal;
import com.ssafy.samulnori.model.dto.user.UserDTO;

import java.util.List;

@RestController
@RequestMapping("/follow")
@RequiredArgsConstructor
public class FollowController {

    private final FollowService followService;

    // 1. 팔로우 하기
    @PostMapping("/{followeeId}")
    public ResponseEntity<?> follow(@AuthenticationPrincipal LoginUserPrincipal user,
                                    @PathVariable Long followeeId) {
        followService.follow(Long.valueOf(user.getUserId()), followeeId);
        return ResponseEntity.ok("팔로우 완료");
    }

    // 2. 언팔로우 하기
    @DeleteMapping("/{followeeId}")
    public ResponseEntity<?> unfollow(@AuthenticationPrincipal LoginUserPrincipal user,
                                      @PathVariable Long followeeId) {
        followService.unfollow(Long.valueOf(user.getUserId()), followeeId);
        return ResponseEntity.ok("언팔로우 완료");
    }


    // 3. 팔로우하는 사람들
    @GetMapping("/followers/{userId}")
    public ResponseEntity<List<UserDTO>> getFollowers(@PathVariable Long userId) {
        return ResponseEntity.ok(followService.getFollowers(userId));
    }

    // 4. 팔로우한 사람들
    @GetMapping("/followings/{userId}")
    public ResponseEntity<List<UserDTO>> getFollowings(@PathVariable Long userId) {
        return ResponseEntity.ok(followService.getFollowings(userId));
    }
}

