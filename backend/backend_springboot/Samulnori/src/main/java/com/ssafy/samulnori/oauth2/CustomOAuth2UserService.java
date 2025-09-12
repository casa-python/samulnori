package com.ssafy.samulnori.oauth2;

import com.ssafy.samulnori.model.dto.auth.*;
import com.ssafy.samulnori.model.entity.SocialAccount;
import com.ssafy.samulnori.model.entity.UserEntity;
import com.ssafy.samulnori.model.repository.SocialAccountRepository;
import com.ssafy.samulnori.model.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
public class CustomOAuth2UserService extends DefaultOAuth2UserService {

    private final UserRepository userRepository;
    private final SocialAccountRepository socialAccountRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        OAuth2User oAuth2User = super.loadUser(userRequest);

        String registrationId = userRequest.getClientRegistration().getRegistrationId();
        OAuth2Response oAuth2Response;

        // 소셜 제공자별 파싱
        switch (registrationId) {
            case "kakao" -> oAuth2Response = new KakaoResponse(oAuth2User.getAttributes());
            case "naver" -> oAuth2Response = new NaverResponse(oAuth2User.getAttributes());
            case "google" -> oAuth2Response = new GoogleResponse(oAuth2User.getAttributes());
            default -> throw new OAuth2AuthenticationException("지원하지 않는 소셜 로그인입니다: " + registrationId);
        }

        String provider = oAuth2Response.getProvider();
        String providerId = oAuth2Response.getProviderId();

        Optional<SocialAccount> optionalSocialAccount = socialAccountRepository.findByProviderAndProviderId(provider, providerId);
        UserEntity user;

        if (optionalSocialAccount.isEmpty()) {
            System.out.println(provider + " " + providerId + " 신규 사용자");
            // 신규 사용자
            user = UserEntity.builder()
                    .email(oAuth2Response.getEmail())
                    .nickname(oAuth2Response.getNickname())
                    .loginName(provider+"_"+providerId)
                    .profileImg(oAuth2Response.getProfileImgUrl())
                    .createdAt(LocalDateTime.now())
                    .build();

            userRepository.save(user);

            SocialAccount socialAccount = SocialAccount.builder()
                    .provider(provider)
                    .providerId(providerId)
                    .user(user)
                    .build();

            socialAccountRepository.save(socialAccount);
        } else {
            // 기존 사용자 - 정보 업데이트 없이 그대로 사용
            user = optionalSocialAccount.get().getUser();
            System.out.println("기존 사용자 로그인 시도");
        }

        // DTO 생성 및 반환
        AuthUserDTO DTO = new AuthUserDTO();
        DTO.setUserId(Long.toString(user.getId()));
        DTO.setLoginName(provider+"_"+providerId);
        DTO.setRole("ROLE_USER");

        return new LoginUserPrincipal(DTO);
    }
}
