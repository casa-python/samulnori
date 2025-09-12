package com.ssafy.samulnori.model.dto.auth;

import java.util.Map;

public class GoogleResponse implements OAuth2Response {

    private final Map<String, Object> attributes;

    public GoogleResponse(Map<String, Object> attributes) {
        this.attributes = attributes;
    }

    @Override
    public String getProvider() {
        return "google";
    }

    @Override
    public String getProviderId() {
        return (String) attributes.get("sub");
    }

    @Override
    public String getEmail() {
        return (String) attributes.get("email");
    }

    @Override
    public String getNickname() {
        return (String) attributes.get("name"); // name이 실명 or 닉네임 역할
    }

    @Override
    public String getProfileImgUrl() {
        return (String) attributes.get("picture");
    }
}
