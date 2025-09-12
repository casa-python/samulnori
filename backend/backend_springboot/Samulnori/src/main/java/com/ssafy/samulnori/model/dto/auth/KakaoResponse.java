package com.ssafy.samulnori.model.dto.auth;

import java.util.Map;

public class KakaoResponse implements OAuth2Response {

    private final Map<String, Object> attributes;
    private final Map<String, Object> kakaoAccount;
    private final Map<String, Object> profile;

    public KakaoResponse(Map<String, Object> attributes) {
        this.attributes = attributes;
        this.kakaoAccount = (Map<String, Object>) attributes.get("kakao_account");
        this.profile = (Map<String, Object>) kakaoAccount.get("profile");
    }

    @Override
    public String getProvider() {
        return "kakao";
    }

    @Override
    public String getProviderId() {
        return String.valueOf(attributes.get("id"));
    }

    @Override
    public String getEmail() {
        return (String) kakaoAccount.get("email"); // 선택 사항이므로 null 가능
    }

    @Override
    public String getNickname() {
        return profile != null ? (String) profile.get("nickname") : null;
    }

    @Override
    public String getProfileImgUrl() {
        return profile != null ? (String) profile.get("profile_image_url") : null;
    }
}
