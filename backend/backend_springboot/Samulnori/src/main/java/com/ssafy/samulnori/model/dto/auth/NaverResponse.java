package com.ssafy.samulnori.model.dto.auth;

import java.util.Map;
public class NaverResponse implements OAuth2Response {

    private final Map<String, Object> response;

    public NaverResponse(Map<String, Object> attributes) {
        this.response = (Map<String, Object>) attributes.get("response");
    }

    @Override
    public String getProvider() {
        return "naver";
    }

    @Override
    public String getProviderId() {
        return (String) response.get("id");
    }

    @Override
    public String getEmail() {
        return (String) response.get("email");
    }

    @Override
    public String getNickname() {
        return (String) response.get("nickname"); // 선택 사항
    }

    @Override
    public String getProfileImgUrl() {
        return (String) response.get("profile_image"); // 선택 사항
    }
}
