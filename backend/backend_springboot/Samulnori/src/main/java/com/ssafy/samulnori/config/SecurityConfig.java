package com.ssafy.samulnori.config;

import com.ssafy.samulnori.filter.JwtFilter;
import com.ssafy.samulnori.oauth2.CustomOAuth2UserService;
import com.ssafy.samulnori.oauth2.CustomSuccessHandler;
import com.ssafy.samulnori.util.JwtUtil;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.util.*;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final CustomOAuth2UserService customOAuth2UserService;
    private final JwtUtil jwtUtil;
    private final CustomSuccessHandler customSuccessHandler;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        //csrf disable
        http
                .csrf((auth) -> auth.disable());
        //From 로그인 방식 disable
        http
                .formLogin((auth) -> auth.disable());
        //HTTP Basic 인증 방식 disable
        http
                .httpBasic((auth) -> auth.disable());
        //JWTFilter 추가
        http
                .addFilterBefore(new JwtFilter(jwtUtil), UsernamePasswordAuthenticationFilter.class);
        //oauth2
        http
                .oauth2Login((oauth2) -> oauth2
                        .userInfoEndpoint((userInfoEndpointConfig) -> userInfoEndpointConfig
                                .userService(customOAuth2UserService)).
                        successHandler(customSuccessHandler));
        //경로별 인가 작업
        http
                .authorizeHttpRequests((auth) -> auth
                        .anyRequest().permitAll()
                );
        //세션 설정 : STATELESS
        http
                .sessionManagement((session) -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS));

//        http
//                .cors(corsCustomizer -> corsCustomizer.configurationSource(new CorsConfigurationSource() {
//
//                    @Override
//                    public CorsConfiguration getCorsConfiguration(HttpServletRequest request) {
//
//                        CorsConfiguration configuration = new CorsConfiguration();
//
//                        configuration.setAllowedOrigins(List.of("http://localhost:3000", "http://localhost:3001", "https://i13a108.p.ssafy.io"));
//                        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
//                        configuration.setAllowCredentials(true);
//                        configuration.setAllowedHeaders(List.of("*"));
//                        configuration.setMaxAge(3600L);
//
//                        configuration.setExposedHeaders(Arrays.asList("Set-Cookie", "Authorization"));
//
//                        return configuration;
//                    }
//                }));

        return http.build();
    }
}